export interface PanelProps {
  title?: string;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      panel: PanelProps;
    }
  }
}

export function render(title: string | undefined): unknown {
  const props: PanelProps = {
    ...(title === undefined ? {} : { title }),
  };
  return <panel {...props} />;
}
