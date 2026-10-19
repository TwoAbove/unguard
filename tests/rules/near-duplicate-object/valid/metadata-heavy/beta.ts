interface Api { endpoint: string; }
interface RequestOptions { url: string; }
interface Context {
  api: Api;
  client: { fetch(options: RequestOptions): Promise<string>; };
}
declare const external: { path: string };
declare function options(api: Api): RequestOptions;

export const beta = {
  id: "beta",
  path: "/beta",
  title: "beta page",
  description: "beta description",
  category: "beta category",
  label: "beta label",
  icon: "beta icon",
  order: 2,
  enabled: true,
  visible: true,
  searchable: true,
  cacheable: false,
  parent: () => external,
  load: ({ context }: { context: Context }) => context.client.fetch(options(context.api)),
};
