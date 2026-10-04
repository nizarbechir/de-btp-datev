import cds from "@sap/cds";

import { DomainError } from "./requests";



/**
 * Failure logging for operations that run in the background of a user action (bank import and
 * matching, accountant export, document extraction, e-mail). Logs what is needed for diagnosis —
 * operation, organization, error code and message — never document contents, statement data,
 * tokens or other payloads. Business rule violations (DomainError) are expected and logged at
 * info level only. In production the log format is JSON with the request's correlation ID.
 */
export function logFailure(
	component: string,
	operation: string,
	error: unknown,
	context: Record<string, unknown> = {},
) {
	const log = cds.log(component);
	const organization = (cds.context?.user?.attr as Record<string, unknown> | undefined)?.organization;
	const details = { ...context, operation, organization };
	if (error instanceof DomainError) {
		log.info(`${operation} rejected: ${error.code}`, details);
		return;
	}
	const message = error instanceof Error ? error.message : String(error);
	log.error(`${operation} failed: ${message}`, details, error instanceof Error ? error.stack : undefined);
}
