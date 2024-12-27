import React from "react";

const DropArea = ({ children, addFiles }) => {
  const dragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add("highlight");
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add("highlight");
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove("highlight");
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove("highlight");
    if (event.dataTransfer.files !== null) {
      addFiles(event.dataTransfer.files);
    }
  };

  return (
    <div
      className="drop-area"
      onDragEnter={dragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
};
export default DropArea;
