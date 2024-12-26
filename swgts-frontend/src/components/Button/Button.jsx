import "./style.css";

const Button = ({ label = "", disabled = false, onClick = () => {}, icon }) => {
  return (
    <button disabled={disabled} className={"btn"} onClick={onClick}>
      {label}
      {icon}
    </button>
  );
};
export default Button;
