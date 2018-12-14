import fetch from 'isomorphic-fetch';

export const fetchText = (url: string): Promise<any> =>
  fetch(url).then((response: any) => {
    if (response.status >= 400) {
      throw new Error('Bad response from server');
    }
    return response.text();
  });

export const fetchJson = (url: string): Promise<any> =>
  fetch(url).then((response: any) => {
    if (response.status >= 400) {
      throw new Error('Bad response from server');
    }
    return response.json();
  });
