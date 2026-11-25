import { createParamDecorator, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { Operator, OperatorRequest } from "./operator.guard";

/** The operator `OperatorGuard` resolved for this request. */
export const CurrentOperator = createParamDecorator(
  (_: unknown, context: ExecutionContext): Operator => {
    const operator = context.switchToHttp().getRequest<OperatorRequest>().operator;
    if (!operator) throw new UnauthorizedException("operator required");
    return operator;
  },
);
