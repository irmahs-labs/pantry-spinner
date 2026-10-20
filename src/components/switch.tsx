export const Switch = ({ on, large }: { on: boolean; large?: boolean }) => (
  <span
    aria-hidden="true"
    className={`switch${on ? " switch--on" : ""}${large ? " switch--lg" : ""}`}
  />
);
