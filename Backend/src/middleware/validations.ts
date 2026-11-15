/**
 * VALIDATION MIDDLEWARE
 * This file contains middleware functions for validating incoming requests.
 * We use Zod, a TypeScript-first schema validation library, to ensure
 * that the data we receive from clients is in the correct format.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';


// Validations

/**
 * VALIDATE BODY MIDDLEWARE
 * This function validates the request body against a Zod schema.
 * If validation fails, it returns a 400 error with details about what went wrong.
 * 
 * @param schema - A Zod schema that defines the expected structure of the request body
 * @returns Middleware function that validates req.body
 */

export const validateBody = (schema: z.ZodTypeAny) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // Attempt to parse and validate the request body against the schema
            const validatedData = schema.parse(req.body);

            // If validation succeeds, replace req.body with the validated data
            // This ensures that only valid data is passed to the next middleware
            req.body = validatedData;

            // Continue to the next middleware or route handler
            next();
        } catch (error) {
            // If validation fails, Zod throws a ZodError
            handle_zod_error(res, error, "Validation failed");
        }
    }
}

/**
 * VALIDATE PARAMS MIDDLEWARE
 * This function validates URL parameters (like /vehicles/:id) against a Zod schema.
 * 
 * @param schema - A Zod schema that defines the expected URL parameters
 * @returns Middleware function that validates req.params
 */

export const validateParams = (schema: z.ZodTypeAny) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.params);
            next();
        } catch (error) {
            handle_zod_error(res, error, "Invalid params");
        }
    }
}

/**
 * VALIDATE QUERY MIDDLEWARE
 * This function validates query string parameters (like /vehicles?year=2024) against a Zod schema.
 * 
 * @param schema - A Zod schema that defines the expected query parameters
 * @returns Middleware function that validates req.query
 */
export const validateQuery = (schema: z.ZodTypeAny) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.query);
            next();
        } catch (error) {
            handle_zod_error(res, error, "Invalid query params");
        }
    }
}

// Every validations repeat same error code, to clean that, create a function to errors

function handle_zod_error(res: Response, error: unknown, message: string) {
    if (error instanceof z.ZodError) {
        return res.status(400).json({
            message,
            errors: error.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message,
            })),
        });
    }
}