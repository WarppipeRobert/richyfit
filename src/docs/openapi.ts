// docs/openapi.ts
import type { OpenAPIV3 } from "openapi-types";

export const openapi: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Coach API",
    version: "1.0.0"
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },
    schemas: {
      ApiError: {
        type: "object",
        required: ["code", "message", "details"],
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          details: { type: "object", additionalProperties: true }
        }
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/openapi.json": {
      get: {
        tags: ["Docs"],
        security: [],
        responses: {
          "200": {
            description: "OpenAPI JSON"
          }
        }
      }
    },
    "/docs": {
      get: {
        tags: ["Docs"],
        security: [],
        responses: {
          "200": { description: "Swagger UI" }
        }
      }
    },

    "/auth/login": {
      post: {
        tags: ["Auth"],
        security: [],
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object" } // keep minimal; tighten later
            }
          }
        },
        responses: {
          "200": { description: "OK" },
          "400": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "429": { description: "Rate limited", headers: { "Retry-After": { schema: { type: "string" } } } }
        }
      }
    },

    "/auth/register": {
      post: {
        tags: ["Auth"],
        security: [],
        summary: "Register",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object" }
            }
          }
        },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "429": { description: "Rate limited", headers: { "Retry-After": { schema: { type: "string" } } } }
        }
      }
    },

    "/clients": {
      get: {
        tags: ["Clients"],
        summary: "List clients",
        responses: {
          "200": { description: "OK" },
          "401": { description: "Unauthenticated", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "429": { description: "Rate limited", headers: { "Retry-After": { schema: { type: "string" } } } }
        }
      },
      post: {
        tags: ["Clients"],
        summary: "Create client",
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", minLength: 1, maxLength: 200 },
                  email: { type: "string", format: "email" }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "409": { description: "Conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "429": { description: "Rate limited", headers: { "Retry-After": { schema: { type: "string" } } } }
        }
      }
    },

    "/clients/{clientId}": {
      get: {
        tags: ["Clients"],
        summary: "Get client by id",
        parameters: [
          { name: "clientId", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "200": { description: "OK" },
          "404": { description: "Not found (ownership-hidden)", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } }
        }
      }
    },

    "/clients/{clientId}/uploads": {
      get: {
        tags: ["Uploads"],
        summary: "List attachments (metadata only)",
        parameters: [
          { name: "clientId", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "200": { description: "OK" },
          "404": { description: "Not found (ownership-hidden)", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } }
        }
      },
      post: {
        tags: ["Uploads"],
        summary: "Initiate upload (presigned PUT URL)",
        parameters: [
          { name: "clientId", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["type", "contentType"],
                properties: {
                  type: { type: "string", enum: ["progress_photo", "document"] },
                  contentType: { type: "string", enum: ["image/jpeg", "image/png", "application/pdf"] },
                  sizeBytes: { type: "integer", minimum: 1 }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "404": { description: "Not found (ownership-hidden)", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } }
        }
      }
    }
  }
};
