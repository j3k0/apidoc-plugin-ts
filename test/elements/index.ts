interface Payload {
  p1: number
  p2: boolean
}

interface Response {
  r1: string
  r2: number
}

/**
 * @api {post} /api
 * @apiParamInterface {Payload}
 * @apiSuccessInterface {Response}
 * @apiGroup elementsTest
 */
