import "./style.css";

const Checkbox = ({
  label = "",
  disabled = false,
  val = false,
  set = (ignore) => {},
}) => {
  return (
    <div className={"checkbox"}>
      <input
        type="checkbox"
        checked={val}
        onChange={() => set((prev) => !prev)}
        disabled={disabled}
      />
      {label && <span>{label}</span>}
    </div>
  );
};
export default Checkbox;
