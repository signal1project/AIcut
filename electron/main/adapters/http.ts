import axios, { type AxiosRequestConfig } from 'axios';

// HTTP seam shared by all adapters — production uses axios; tests inject a fake.
export interface AdapterHttp {
  request<T = unknown>(config: AxiosRequestConfig): Promise<T>;
}

export const axiosHttp: AdapterHttp = {
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const res = await axios.request<T>(config);
    return res.data;
  },
};
