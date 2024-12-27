import "./style.css";

const Button = ({
  label = "",
  disabledLabel,
  disabled = false,
  onClick = () => {},
  icon,
  className,
}) => {
  return (
    <button
      disabled={disabled}
      className={`btn ${className} ${disabled ? "disabled" : ""}`}
      onClick={onClick}
    >
      {disabledLabel && disabled ? disabledLabel : label}
      {icon}
    </button>
  );
};
export default Button;
