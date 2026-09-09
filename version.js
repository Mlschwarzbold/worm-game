window.WORM_VERSION = "2.9.1";

const versionElement = document.getElementById("app-version");
if (versionElement) {
  versionElement.textContent = `v${window.WORM_VERSION}`;
}
