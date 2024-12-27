import { ALLOWED_EXTENSIONS as allowedExtensions } from "../UploadView";

const UploadInfo = ({ addFiles }) => {
  const handleChange = (event) => {
    if (event.target.files) addFiles(event.target.files);
  };

  return (
    <div className="upload-info">
      <h2>
        Drop files or <br />
        <label htmlFor="upload-file" className={"file-explorer-label"}>
          open file explorer
        </label>
        <input
          type="file"
          name="file"
          id="upload-file"
          className="file-explorer-input"
          onChange={handleChange}
        />
      </h2>
      <div className={"allowed-extensions"}>
        <h2>Supported formats:</h2>
        <div className={"extensions"}>
          {allowedExtensions.map((extension, key) => (
            <h2 key={key} className={"extension"}>
              {extension}
            </h2>
          ))}
        </div>
      </div>
    </div>
  );
};
export default UploadInfo;
