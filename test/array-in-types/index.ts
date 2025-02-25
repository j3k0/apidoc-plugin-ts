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
 * @apiSuccessInterface {SquareConfig[]} squareConfigs
 * @apiGroup arrayWithBracketsTest
 */

/**
 * @api {get} /api/:id
 * @apiParam {SquareConfig} id Unique ID.
 * @apiSuccessInterface {Array<SquareConfig>} squareConfigs
 * @apiGroup arrayAsGenericsTest
 */

/**
 * @api {get} /api/:id
 * @apiParam {SquareConfig} id Unique ID.
 * @apiSuccessInterface {FirstNamespace.SecondNamespace.Result[]} results
 * @apiGroup arrayWithBracketsInNamespaceTest
 */

/**
 * @api {get} /api/:id
 * @apiParam {SquareConfig} id Unique ID.
 * @apiSuccessInterface {Array<FirstNamespace.SecondNamespace.Result>} results
 * @apiGroup arrayAsGenericsInNamespaceTest
 */
