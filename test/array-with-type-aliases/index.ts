interface SquareConfig {
  color: string
  width: number
}

type SquareConfigsType = SquareConfig[]

/**
 * @api {get} /api/:id
 * @apiParam {SquareConfig} id Unique ID.
 * @apiSuccessInterface {SquareConfigsType}
 * @apiGroup arrayAsType
 */
