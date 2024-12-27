import React from "react";

export const ALLOWED_EXTENSIONS = [".fastq.gz", ".fq.gz", ".fastq", ".fq"];

const DropArea = ({ dialogCallback, setFiles, children }) => {
  const validateAndUpdateFiles = (files) => {
    if (
      [...files].every((file) =>
        ALLOWED_EXTENSIONS.some((extension) => file.name.endsWith(extension)),
      ) &&
      files.length <= 2
    ) {
      setFiles([...files]);
      return true;
    } else {
      dialogCallback(
        "You can upload up to 2 files. Allowed extensions are: " +
          ALLOWED_EXTENSIONS.join(", "),
      );
      return false;
    }
  };

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
      validateAndUpdateFiles(event.dataTransfer.files);
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
