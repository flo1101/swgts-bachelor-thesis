import "./style.css";

const Checkbox = ({
  label = "",
  disabled = false,
  val = false,
  set = (ignore) => {},
  className,
}) => {
  return (
    <div className={className ? `${className} checkbox` : "checkbox"}>
      <input
        type="checkbox"
        checked={val}
        onChange={() => set((prev) => !prev)}
        disabled={disabled}
      />
      {label && <span className="label">{label}</span>}
    </div>
  );
};
export default Checkbox;
