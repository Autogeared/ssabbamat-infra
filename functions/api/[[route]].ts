import app from '../../src/index';

export const onRequest: PagesFunction<{ ANTHROPIC_API_KEY: string }> = async (context) => {
  return app.fetch(context.request, context.env);
};
