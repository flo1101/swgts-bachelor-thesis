import { ALLOWED_EXTENSIONS as allowedExtensions } from "./DropArea";

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
      <div className={"allowed-extensions"}>
        <h2>Allowed extensions:</h2>
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
