declare module 'swagger-jsdoc' {
  import type { OpenAPIV3 } from 'openapi-types';

  namespace swaggerJsdoc {
    interface SwaggerDefinition {
      openapi?: string;
      swagger?: string;
      info?: {
        title?: string;
        version?: string;
        description?: string;
        contact?: Record<string, string>;
        license?: Record<string, string>;
        [key: string]: unknown;
      };
      servers?: Array<{ url: string; description?: string }>;
      components?: Record<string, unknown>;
      security?: Array<Record<string, unknown>>;
      tags?: Array<{ name: string; description?: string }>;
      paths?: Record<string, unknown>;
      [key: string]: unknown;
    }

    interface Options {
      definition: SwaggerDefinition;
      apis: string | string[];
    }
  }

  function swaggerJsdoc(
    options: swaggerJsdoc.Options,
  ): Record<string, unknown>;

  export = swaggerJsdoc;
}

declare module 'swagger-ui-express' {
  import type { Request, Response } from 'express';

  namespace swaggerUi {
    interface SwaggerOptions {
      customCss?: string;
      customCssUrl?: string;
      customJs?: string;
      customfavIcon?: string;
      explorer?: boolean;
      swaggerUrl?: string;
      swaggerOptions?: Record<string, unknown>;
      swaggerHtml?: string;
      [key: string]: unknown;
    }

    function setup(
      swaggerDoc?: Record<string, unknown> | null,
      options?: SwaggerOptions,
    ): (req: Request, res: Response) => void;
    function serve(req: Request, res: Response): void;
    function serveStatic(): (req: Request, res: Response) => void;
  }

  export = swaggerUi;
}
