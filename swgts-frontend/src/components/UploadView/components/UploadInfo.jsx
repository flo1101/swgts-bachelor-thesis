const UploadInfo = () => {
  return (
    <div className="upload-info">
      <h2>
        Drop files or <br />
        <label htmlFor="upload-file" className={"file-explorer-label"}>
          choose manually
        </label>
        <input
          type="file"
          name="file"
          id="upload-file"
          className="file-explorer-input"
        />
      </h2>
    </div>
  );
};
export default UploadInfo;
