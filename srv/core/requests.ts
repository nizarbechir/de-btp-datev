import cds from "@sap/cds";

import { EmailNotConfiguredError } from "../integrations/email/email-provider";

/** Key of a record; drafts also carry IsActiveEntity. */
export interface EntityKey {
	ID: string;
	IsActiveEntity?: boolean | string;
}

/** Thrown for business rule violations; handlers turn it into a 4xx response with the message. */
export class DomainError extends Error {
	constructor(
		public code: string,
		public status = 409,
		public args: unknown[] = [],
	) {
		super(code);
	}
}

/** The ID of the record a bound action or request is called on. */
export function boundID(req: cds.Request): string {
	return boundKey(req).ID;
}

/** The key of the record a bound action or request is called on. */
export function boundKey(req: cds.Request): EntityKey {
	const value = req.params.at(-1);
	return (typeof value === "object" ? value : { ID: value }) as EntityKey;
}

/** Runs a domain operation and turns business rule violations into readable errors. */
export async function guarded<T>(req: cds.Request, operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		return rejectDomainError(req, error);
	}
}

/** Like `guarded`, but returns the bound record after the operation (for bound actions returning their entity). */
export async function guardedSubject(req: cds.Request, operation: () => Promise<unknown>) {
	return guarded(req, async () => {
		await operation();
		return SELECT.one.from(req.subject);
	});
}

/** Rejects the request with the domain error's message, or rethrows anything else. */
export function rejectDomainError(req: cds.Request, error: unknown): never {
	if (error instanceof DomainError) {
		return req.reject(error.status, error.code, undefined, error.args) as never;
	}
	if (error instanceof EmailNotConfiguredError) {
		return req.reject(503, "EMAIL_NOT_CONFIGURED") as never;
	}
	throw error;
}
