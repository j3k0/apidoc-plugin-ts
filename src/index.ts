import * as ts from 'typescript'
import * as path from 'path'
import { Project as Ast, InterfaceDeclaration, PropertySignature, Symbol, SourceFile, NamespaceDeclaration, Type } from 'ts-morph'
import exp from 'constants'

const CUSTOM_ELEMENT_NAMES = {
  API_ERROR_INTERFACE: 'apierrorinterface',
  API_SUCCESS_INTERFACE: 'apisuccessinterface',
  API_PARAM_INTERFACE: 'apiparaminterface',
  API_QUERY_INTERFACE: 'apiqueryinterface',
  API_BODY_INTERFACE: 'apibodyinterface'
}

const APIDOC_ELEMENT_BY_CUSTOM_ELEMENT_NAME = {
  [CUSTOM_ELEMENT_NAMES.API_ERROR_INTERFACE]: 'apiError',
  [CUSTOM_ELEMENT_NAMES.API_SUCCESS_INTERFACE]: 'apiSuccess',
  [CUSTOM_ELEMENT_NAMES.API_PARAM_INTERFACE]: 'apiParam',
  [CUSTOM_ELEMENT_NAMES.API_QUERY_INTERFACE]: 'apiQuery',
  [CUSTOM_ELEMENT_NAMES.API_BODY_INTERFACE]: 'apiBody'
}

for (let i = 200; i < 600; i++) {
  const name = `apisuccess${i}interface`
  CUSTOM_ELEMENT_NAMES[`API_SUCCESS${i}_INTERFACE`] = name
  APIDOC_ELEMENT_BY_CUSTOM_ELEMENT_NAME[name] = `apiSuccess (${i < 300 ? 'Success' : 'Error'} ${i})`
}

for (let i = 200; i < 600; i += 100) {
  const name = `apisuccess${i / 100}xxinterface`
  CUSTOM_ELEMENT_NAMES[`API_SUCCESS${i / 100}xx_INTERFACE`] = name
  APIDOC_ELEMENT_BY_CUSTOM_ELEMENT_NAME[name] = `apiSuccess (${i < 300 ? 'Success' : 'Error'} ${i / 100}xx)`
}

const definitionFilesAddedByUser: {[key: string]: boolean} = {}

namespace Apidoc {
  export enum AvailableHook {
    'parser-find-elements' = 'parser-find-elements'
  }

  export interface App {
    addHook (name: AvailableHook, func: Function, priority?: number)
  }

  export interface Element {
    source: string
    name: string
    sourceName: string
    content: string
  }

  export type ParserFindElementsHookCallback = (
    elements: Element[],
    element: Element,
    block: string,
    filename: string
  ) => void
}

const ast = new Ast()

/**
 * Initialise plugin (add app hooks)
 * @param app
 */
export function init (app: Apidoc.App) {
  app.addHook(Apidoc.AvailableHook['parser-find-elements'], parseElements.bind(app), 200)
}

/**
 * Parse elements
 * @param elements
 * @param element
 * @param block
 * @param filename
 */
function parseElements (elements: Apidoc.Element[], element: Apidoc.Element, block: string, filename: string) {

  // We only want to do things with the instance of our custom elements.
  if (!Object.values(CUSTOM_ELEMENT_NAMES).includes(element.name)) return

  // Remove the element
  elements.pop()

  // Create array of new elements
  const newElements: Apidoc.Element[] = []

  // Get object values
  const values = parse(element.content, element.name)

  // Only if there are values...
  if (!values) {
    this.log.warn(`Could not find parse values of element: ${element.content}`)
    return
  }

  // The interface we are looking for
  const namedInterface = values.interface.trim()

  // Get the file path to the interface
  const interfacePath = values.path ? path.resolve(path.dirname(filename), values.path.trim()) : filename
  const parentNamespace = parseDefinitionFiles.call(this, interfacePath)
  const { namespace, leafName } = extractNamespace.call(this, parentNamespace, namedInterface)

  if (isNativeType(leafName)) {
    parseNative(elements, newElements, interfacePath, values)
    return
  }
  const arrayMatch = matchArrayInterface(leafName)
  if (arrayMatch) {
    parseArray.call(this, elements, newElements, values, interfacePath, namespace, arrayMatch)
    return
  }
  parseInterface.call(this, elements, newElements, values, interfacePath, namespace, leafName)
  // Does the interface exist in current file?
}

function parseNative (elements: Apidoc.Element[], newElements: Apidoc.Element[], interfacePath: string, values: ParseResult) {
  setNativeElements(interfacePath, newElements, values)
  elements.push(...newElements)
}

function parseArray (elements: Apidoc.Element[], newElements: Apidoc.Element[], values: ParseResult, interfacePath: string, namespace: NamespaceDeclaration, arrayMatch: ArrayMatch) {
  const interfaceName = arrayMatch.interface
  const matchedInterface = getNamespacedInterface(namespace, interfaceName)
  if (!matchedInterface) {
    this.log.warn(`Could not find interface «${interfaceName}» in file «${interfacePath}»`)
    return
  }
  setArrayElements.call(this, matchedInterface, interfacePath, newElements, values, interfaceName)
  elements.push(...newElements)
}

function parseInterface (elements: Apidoc.Element[], newElements: Apidoc.Element[], values: ParseResult, interfacePath: string, namespace: NamespaceDeclaration, leafName: string) {
  const matchedInterface = getNamespacedInterface(namespace, leafName)

  // If interface is not found, log error
  if (!matchedInterface) {
    this.log.warn(`Could not find interface «${values.interface}» in file «${interfacePath}»`)
    return
  }

  // Match elements of current interface
  setInterfaceElements.call(this, matchedInterface, interfacePath, newElements, values)

  // Push new elements into existing elements
  elements.push(...newElements)
}

interface ParseResult {
  element: string
  interface: string
  path: string
  field: string
  description: string
}

interface ArrayMatch {
  full: string
  interface: string
}

enum PropType {
  Enum = 'Enum',
  Array = 'Array',
  Object = 'Object',
  Native = 'Native'
}

/**
 * Parse element content
 * @param content
 * @param elementName
 */
function parse (content: string, elementName: string): ParseResult | null {
  if (content.length === 0) return null

  const parseRegExp = /^(?:\((.+?)\)){0,1}\s*\{(.+?)\}\s*(?:([^\s]*))?\s*(?:(.+))?/g
  const matches = parseRegExp.exec(content)

  if (!matches) return null

  return {
    element: APIDOC_ELEMENT_BY_CUSTOM_ELEMENT_NAME[elementName],
    path: matches[1],
    interface: matches[2],
    field: matches[3] || '',
    description: matches[4] || ''
  }
}

/**
 *
 * @param matchedInterface
 * @param filename
 * @param newElements
 * @param values
 * @param interfaceName
 */
function setArrayElements (
    matchedInterface: InterfaceDeclaration,
    filename: string,
    newElements: Apidoc.Element[],
    values: ParseResult,
    interfaceName: string
) {
  const field = values.field || getDecapitalized(interfaceName)
  const description = values.description || field
  if (shouldIgnore(description)) return
  newElements.push(getApiElement(values.element, `{Object[]} ${markOptional(field, false, description)} ${removeTags(description)}`))
  setInterfaceElements.call(this, matchedInterface, filename, newElements, values, field)
}
/**
 *
 * @param matchedInterface
 * @param filename
 * @param newElements
 * @param values
 * @param inttype
 */
function setInterfaceElements (
  matchedInterface: InterfaceDeclaration,
  filename: string,
  newElements: Apidoc.Element[],
  values: ParseResult,
  inttype?: string
) {
  // If this is an extended interface
  extendInterface.call(this, matchedInterface, filename, newElements, values, inttype)

  // Iterate over interface properties
  matchedInterface.getProperties().forEach((prop: PropertySignature) => {
    // Set param type definition and description
    const typeDef = inttype ? `${inttype}.${prop.getName()}` : prop.getName()
    const documentationComments = prop.getJsDocs().map((node) => node.getInnerText()).join()
    if (shouldIgnore(documentationComments)) return
    const description = documentationComments
      ? `\`${typeDef}\` - ${documentationComments}`
      : `\`${typeDef}\``

    // Set property type as a string
    const propTypeName = getPropTypeText(prop.getType()) // .getText()
    const typeEnum = getPropTypeEnum(prop)
    const propLabel = getPropLabel(typeEnum, propTypeName)
    // Set the element
    newElements.push(getApiElement(values.element, `{${propLabel}} ${markOptional(typeDef, prop.hasQuestionToken(), description)} ${removeTags(description)}`))

    // If property is an object or interface then we need to also display the objects properties
    if ([PropType.Object, PropType.Array].includes(typeEnum)) {
      // First determine if the object is an available interface
      const typeInterface = getInterface.call(this, filename, propTypeName)

      const arrayType = typeEnum === PropType.Array && prop.getType().getArrayElementType()
      const objectProperties = arrayType
        ? arrayType.getProperties()
        : prop.getType().getProperties()

      if (typeInterface) {
        setInterfaceElements.call(this, typeInterface, filename, newElements, values, typeDef)
      } else {
        setObjectElements.call(this, objectProperties, filename, newElements, values, typeDef)
      }
    }
  })
}

/**
 * @param {string} name
 * @param {boolean} hasQuestionToken
 * @param {string} description
 * @return {sting}
 */
function markOptional(name, hasQuestionToken, description) {
  if (hasRequiredTag(description)) return name;
  if (hasOptionalTag(description)) return `[${name}]`;
  return hasQuestionToken ? `[${name}]` : name;
}

/**
 * @param {string} description
 * @return {string}
 */
function removeTags(description) {
  return description.replace('@required', '').replace('@optional', '')
  // return description.replace(/(\s|^)@(required|optional)(\s|$)/, '\1\2')
}

/**
 *
 * @param filename
 * @param newElements
 * @param values
 */
function setNativeElements (
  filename: string,
  newElements: Apidoc.Element[],
  values: ParseResult
  // inttype?: string
) {
  const propLabel = getCapitalized(values.interface)
  // Set the element
  if (shouldIgnore(values.description)) return
  newElements.push(getApiElement(values.element, `{${propLabel}} ${markOptional(values.field, false, values.description)} ${removeTags(values.description)}`))
  return
}

function getUnionTypeText (type: Type): string | undefined | null {
  return type.getUnionTypes().reduce((expected: string | undefined, type: Type): string | null => {
    if (expected === undefined) {
      return getPropTypeText(type)
    } else if (expected === getPropTypeText(type)) {
      return expected
    } else {
      return null
    }
  }, undefined)
}

function getPropTypeText (type: Type): string {
  if (type.isUnion()) {
    const uType = getUnionTypeText(type)
    if (uType) return uType
  }
  if (type.isStringLiteral()) return 'string'
  return type.getText()
}

/**
 * Set element if type object
 */
function setObjectElements<NodeType extends ts.Node = ts.Node> (
  properties: Symbol[],
  filename: string,
  newElements: Apidoc.Element[],
  values: ParseResult,
  typeDef: string
) {
  properties.forEach((property) => {
    const valueDeclaration = property.getValueDeclaration()
    if (!valueDeclaration) return

    const propName = property.getName()
    const typeDefLabel = `${typeDef}.${propName}`
    const propType = getPropTypeText(valueDeclaration.getType()) // .getText(valueDeclaration)

    const isUserDefinedProperty = isUserDefinedSymbol(property.compilerSymbol)
    if (!isUserDefinedProperty) return // We don't want to include default members in the docs

    const documentationComments = property.compilerSymbol.getDocumentationComment(undefined).map((node) => node.text).join()
    if (shouldIgnore(documentationComments)) return

    const desc = documentationComments
      ? `\`${typeDef}.${propName}\` - ${documentationComments}`
      : `\`${typeDef}.${propName}\``

    const isNullable = property.getDeclaredType().isNullable();

    // Nothing to do if prop is of native type
    if (isNativeType(propType)) {
      newElements.push(getApiElement(values.element, `{${getCapitalized(propType)}} ${markOptional(typeDefLabel, isNullable, desc)} ${removeTags(desc)}`))
      return
    }

    const isEnum = valueDeclaration.getType().isEnum()
    if (isEnum) {
      newElements.push(getApiElement(values.element, `{Enum} ${markOptional(typeDefLabel, isNullable, desc)} ${removeTags(desc)}`))
      return
    }

    const newElement = getApiElement(values.element, `{Object${propType.includes('[]') ? '[]' : ''}} ${markOptional(typeDefLabel, isNullable, desc)} ${removeTags(desc)}`)
    newElements.push(newElement)

    // If property is an object or interface then we need to also display the objects properties
    const typeInterface = getInterface.call(this, filename, propType)

    if (typeInterface) {
      setInterfaceElements.call(this, typeInterface, filename, newElements, values, typeDefLabel)
    } else {

      const externalFileTypeSymbol = valueDeclaration.getType().getSymbol()
      if (!externalFileTypeSymbol) {
        setObjectElements.call(
          this,
          property.getValueDeclarationOrThrow().getType().getProperties(),
          filename,
          newElements,
          values,
          typeDef
        )
        return
      }

      const externalFileDeclaration = externalFileTypeSymbol.getDeclarations()[0]
      const externalFileInterface = externalFileDeclaration.getSourceFile().getInterface(propType)

      if (!externalFileInterface) {
        setObjectElements.call(
          this,
          property.getValueDeclarationOrThrow().getType().getProperties(),
          filename,
          newElements,
          values,
          typeDefLabel
        )
        return
      }

      setObjectElements.call(
        this,
        externalFileInterface.getType().getProperties(),
        filename,
        newElements,
        values,
        typeDefLabel
      )
    }
  })
}

/**
 * Extends the current interface
 * @param matchedInterface
 * @param interfacePath
 * @param newElements
 * @param values
 */
function extendInterface (
  matchedInterface: InterfaceDeclaration,
  interfacePath: string,
  newElements: Apidoc.Element[],
  values: ParseResult,
  inttype?: string
) {
  for (const extendedInterface of matchedInterface.getExtends()) {
    const extendedInterfaceName = extendedInterface.compilerNode.expression.getText()
    const parentNamespace = matchedInterface.getParentNamespace() || parseDefinitionFiles.call(this, interfacePath)
    const { namespace, leafName } = extractNamespace.call(this, parentNamespace, extendedInterfaceName)
    const matchedExtendedInterface = getNamespacedInterface.call(this, namespace, leafName)
    if (!matchedExtendedInterface) {
      this.log.warn(`Could not find interface to be extended ${extendedInterfaceName}`)
      return
    }

    extendInterface.call(this, matchedExtendedInterface, interfacePath, newElements, values)
    setInterfaceElements.call(this, matchedExtendedInterface, interfacePath, newElements, values, inttype)
  }
}

function getApiElement (element: string, param: string | number): Apidoc.Element {
  const elementName = element.split(' ')[0]
  const elementParam = element.slice(elementName.length)
  return {
    content: `${elementParam}${param}\n`,
    name: elementName.toLowerCase(),
    source: `@${element} ${param}\n`,
    sourceName: elementName
  }
}

type NamespacedContext = SourceFile | NamespaceDeclaration
interface NamespacedDeclaration {
  declaration: InterfaceDeclaration
  parentNamespace: NamespacedContext
}

function parseDefinitionFiles (interfacePath: string): SourceFile | undefined {
  const interfaceFile = ast.addExistingSourceFile(interfacePath)
  if (!interfaceFile) return

  trackUserAddedDefinitionFile(interfaceFile)
  for (const file of ast.resolveSourceFileDependencies()) {
    trackUserAddedDefinitionFile(file)
  }
  return interfaceFile
}

function extractNamespace (
  rootNamespace: NamespacedContext,
  interfaceName: string
): { namespace: NamespaceDeclaration | undefined; leafName: string; } {
  const arrayMatch = matchArrayInterface(interfaceName)
  interfaceName = arrayMatch
    ? arrayMatch.interface + '[]'
    : interfaceName

  const isNamespaced = interfaceName.match(/(?:[a-zA-Z0-9_]\.)*[a-zA-Z0-9_]\./i)

  const nameSegments = isNamespaced
    ? interfaceName.split('.')
    : [interfaceName]

  const namespaces = nameSegments.slice(0, -1)
  const leafName = nameSegments[nameSegments.length - 1]

  const namespace = namespaces.reduce(
    (parent: NamespacedContext | undefined, name: string) => {
      if (!parent) return
      const namespace = parent.getNamespace(name)
      if (!namespace) this.log.warn(`Could not find namespace ${name} in root namespace in file at ${rootNamespace.getSourceFile().getFilePath()}`)
      return namespace
    },
    rootNamespace
  ) as NamespaceDeclaration | undefined
  return {
    namespace,
    leafName
  }
}

function getNamespacedInterface (
  namespace: NamespaceDeclaration,
  interfaceName: string
): InterfaceDeclaration | undefined {
  return namespace.getInterface(interfaceName)
}
function getInterface (interfacePath: string, interfaceName: string): InterfaceDeclaration | undefined {
  const interfaceFile = parseDefinitionFiles(interfacePath)
  const { namespace, leafName } = extractNamespace.call(this, interfaceFile, interfaceName)
  return getNamespacedInterface.call(this, namespace, leafName)
}

function trackUserAddedDefinitionFile (file: SourceFile) {
  definitionFilesAddedByUser[file.getFilePath()] = true
}

function getCapitalized (text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

function getDecapitalized (text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

function isNativeType (propType: string): boolean {
  const nativeTypes = ['boolean', 'Boolean', 'string', 'String', 'number', 'Number', 'Date', 'any']
  return nativeTypes.indexOf(propType) >= 0
}

function getPropTypeEnum (prop: PropertySignature): PropType {
  const propType = getPropTypeText(prop.getType()) // .getType().getText()

  const propTypeIsEnum = prop.getType().isEnum()
  const propTypeIsObject = !propTypeIsEnum && !isNativeType(propType)
  const propTypeIsArray = propTypeIsObject && propType.includes('[]')

  if (propTypeIsArray) return PropType.Array
  if (propTypeIsObject) return PropType.Object
  if (propTypeIsEnum) return PropType.Enum
  return PropType.Native
}

function getPropLabel (typeEnum: PropType, propTypeName: string): string {
  if (typeEnum === PropType.Array) return 'Object[]'
  if (typeEnum === PropType.Object) return 'Object'
  if (typeEnum === PropType.Enum) return 'Enum'

  return getCapitalized(propTypeName)
}

function matchArrayInterface (interfaceName): ArrayMatch | null {
  const match = interfaceName.match(/^Array<(.*)>$/) || interfaceName.match(/^(.*)\[\]$/)
  if (!match) {
    return null
  }
  return {
    full: interfaceName,
    interface: match[1]
  }
}

function isUserDefinedSymbol (symbol: ts.Symbol): boolean {
  const declarationFile = symbol.valueDeclaration.parent.getSourceFile()
  return definitionFilesAddedByUser[declarationFile.fileName]
}

function shouldIgnore (description: string): boolean {
  return !!description && ((description.match(/(\s|^)@private(\s|$)/) !== null) || (description.match(/(\s|^)@ignore(\s|$)/) !== null))
}

function hasOptionalTag (description: string): boolean {
  return !!description && (description.match(/(\s|^)@optional(\s|$)/) !== null)
}

function hasRequiredTag (description: string): boolean {
  return !!description && (description.match(/(\s|^)@required(\s|$)/) !== null)
}
