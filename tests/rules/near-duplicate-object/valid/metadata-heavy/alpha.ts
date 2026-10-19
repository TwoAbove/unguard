interface Api { endpoint: string; }
interface RequestOptions { url: string; }
interface Context {
  api: Api;
  client: { fetch(options: RequestOptions): Promise<string>; };
}
declare const external: { path: string };
declare function options(api: Api): RequestOptions;

export const alpha = {
  id: "alpha",
  path: "/alpha",
  title: "alpha page",
  description: "alpha description",
  category: "alpha category",
  label: "alpha label",
  icon: "alpha icon",
  order: 1,
  enabled: true,
  visible: true,
  searchable: true,
  cacheable: false,
  parent: () => external,
  load: ({ context }: { context: Context }) => context.client.fetch(options(context.api)),
};
