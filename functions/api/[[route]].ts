import app from '../../src/index';

export const onRequest: PagesFunction<{ ANTHROPIC_API_KEY: string; LAYOUTS_KV: KVNamespace }> = async (context) => {
  return app.fetch(context.request, context.env);
};
