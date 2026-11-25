import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";

/** The person using the console. */
export type Operator = { organizationId: string; organizationName: string };

export type OperatorRequest = Request & { operator?: Operator };

const DEFAULT_ORGANIZATION = "Northwind Security";

/**
 * STANDS IN FOR A SESSION — this assignment has no login. Every browser request
 * is an operator of `X-Operator-Org` (an organization name), or of Northwind
 * Security when the header is absent. Treat the resolved `Operator` exactly as
 * you would the claims of a verified session: it is who is asking.
 */
@Injectable()
export class OperatorGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<OperatorRequest>();
    const header = req.headers["x-operator-org"];
    const name = (Array.isArray(header) ? header[0] : header) ?? DEFAULT_ORGANIZATION;
    const organization = await this.prisma.organization.findUnique({ where: { name } });
    if (!organization) throw new UnauthorizedException("unknown operator organization");
    req.operator = { organizationId: organization.id, organizationName: organization.name };
    return true;
  }
}
