import "./style.css";

const Button = ({
  label = "",
  disabled = false,
  onClick = () => {},
  icon,
  className,
}) => {
  return (
    <button
      disabled={disabled}
      className={className ? `btn ${className}` : "btn"}
      onClick={onClick}
    >
      {label}
      {icon}
    </button>
  );
};
export default Button;
