import { useEffect, useState } from "react";
import axios from "axios";
import useStore from "../store";
import { useShallow } from "zustand/react/shallow";

/**
 * State is handled using Zustand.
 * Hooks return state from Zustand-store defined in store.js.
 */

export const FLASK_API_URL = "https://swgts.albi.hhu.de/api/";
/**
 * Verifies backend accessibility and fetches server configuration
 */
export const useGetServerConfig = () => {
  const [serverConfig, setServerConfig] = useStore(
    useShallow((state) => [state.serverConfig, state.setServerConfig]),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchServerConfig = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = `${FLASK_API_URL}server-status`;
      const response = await axios.get(url);
      setServerConfig(response.data);
    } catch (error) {
      console.error("Unable to connect to backend:", error);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServerConfig();
  }, []);

  return {
    serverConfig,
    serverConfigIsLoading: isLoading,
    serverConfigError: error,
    fetchServerConfig,
  };
};
