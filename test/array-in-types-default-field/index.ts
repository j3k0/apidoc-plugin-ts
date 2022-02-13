interface SquareConfig {
  color: string
  width: number
}

export namespace FirstNamespace {
  export namespace SecondNamespace {
    export interface Result {
      id: string
    }
  }
}

/**
 * @api {get} /api/:id
 * @apiParam {SquareConfig} id Unique ID.
 * @apiSuccessInterface {SquareConfig[]}
 * @apiGroup arrayWithBracketsTest
 */

/**
 * @api {get} /api/:id
 * @apiParam {SquareConfig} id Unique ID.
 * @apiSuccessInterface {Array<SquareConfig>}
 * @apiGroup arrayAsGenericsTest
 */

/**
 * @api {get} /api/:id
 * @apiParam {SquareConfig} id Unique ID.
 * @apiSuccessInterface {FirstNamespace.SecondNamespace.Result[]}
 * @apiGroup arrayWithBracketsInNamespaceTest
 */

/**
 * @api {get} /api/:id
 * @apiParam {SquareConfig} id Unique ID.
 * @apiSuccessInterface {Array<FirstNamespace.SecondNamespace.Result>}
 * @apiGroup arrayAsGenericsInNamespaceTest
 */
