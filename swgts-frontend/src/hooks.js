import { useEffect, useState } from "react";
import axios from "axios";
import https from "https-browserify";
import useStore from "./store";

/**
 * State is handled using Zustand.
 * Hooks return state from Zustand-store defined in store.js.
 */

export const API_BASE_URL = process.env.REACT_APP_API_URL;
export const SSL_CRT_FILE = process.env.SSL_CRT_FILE;
export const SSL_KEY_FILE = process.env.SSL_KEY_FILE;

// TODO: Disable SSL verification for locally running frontend
const httpsAgent = new https.Agent({
  cert: SSL_KEY_FILE,
  key: SSL_CRT_FILE,
});

/**
 * Verifies backend accessibility and fetches server configuration
 */
export const useGetServerConfig = () => {
  const [serverConfig, setServerConfig] = useStore((state) => [
    state.serverConfig,
    state.setServerConfig,
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchServerConfig = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = `${API_BASE_URL}server-status`;
      const response = await axios.get(url, { httpsAgent });
      setServerConfig(response.data);
    } catch (error) {
      console.error("Unable to connect to backend:", error);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(async () => {
    await fetchServerConfig();
  }, []);

  return {
    serverConfig,
    serverConfigIsLoading: isLoading,
    serverConfigError: error,
    fetchServerConfig,
  };
};

const useHandleFileUpload = () => {};
