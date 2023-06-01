function Separator(
  properties: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLSpanElement>,
    HTMLSpanElement
  > & { orientation: "horizontal" | "vertical" }
) {
  // eslint-disable-next-line unicorn/prevent-abbreviations
  const { orientation, ...props } = properties;
  return (
    <span
      aria-describedby="separator"
      aria-orientation={orientation}
      {...props}
    />
  );
}

export { Separator };
