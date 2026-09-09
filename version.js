window.WORM_VERSION = "1.6.0";

const versionElement = document.getElementById("app-version");
if (versionElement) {
  versionElement.textContent = `v${window.WORM_VERSION}`;
}
