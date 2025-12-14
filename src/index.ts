import generateIsolines from "./isolines";
import generateIsolinesMS from "./isolines-ms";
import generateIsobandsMS from "./isobands-ms";
import { DemSource } from "./dem-source";
import { decodeParsedImage } from "./decode-image";
import { LocalDemManager } from "./local-dem-manager";
import CONFIG from "./config";
import { HeightTile } from "./height-tile";

const exported = {
  generateIsolines,
  generateIsolinesMS,
  generateIsobandsMS,
  DemSource,
  HeightTile,
  LocalDemManager,
  decodeParsedImage,
  set workerUrl(url: string) {
    CONFIG.workerUrl = url;
  },
  get workerUrl() {
    return CONFIG.workerUrl;
  },
};
export default exported;
