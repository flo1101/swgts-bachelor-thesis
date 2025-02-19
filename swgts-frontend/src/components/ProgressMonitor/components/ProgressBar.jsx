const ProgressBar = ({ total, progress, labels = [], className = "" }) => {
  const fillPercentage = (progress / total) * 100;

  return (
    <div className={`progress-bar ${className}`}>
      <div className={"info"}>
        <div className={"labels"}>
          {labels.map((label) => (
            <span>{label}</span>
          ))}
        </div>
        <span>{`${Math.round(fillPercentage * 10) / 10}%`}</span>
      </div>
      <div className="total">
        <div
          className={`${className}-fill`}
          style={{ width: `${fillPercentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;
