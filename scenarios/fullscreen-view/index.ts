import * as SDCCore from "scandit-web-datacapture-core";
import * as SDCBarcode from "scandit-web-datacapture-barcode";

declare global {
  interface Window {
    continueScanning: () => void;
  }
}

async function run(): Promise<void> {
  // Configure and load the library using your license key. The passed parameter represents the location of the wasm
  // file, which will be fetched asynchronously. You must `await` the returned promise to be able to continue.
  await SDCCore.configure({
    licenseKey: "AVBSfDsCGAPiRWLN5QhuS2k4Wd8rAfsiK1ytqeg5dWn/eoZsUjv4mfgw0CZjFZoSpiXlh2ZyXHUPVpr1L0m5dDEKE4D1dW4SIEwPxCBObyM1LjAl13Q8re5l8Qd6eBvTzkcfwwsZtcW+Lk51TTatMjkgSETrDWhYO4BDDTkcqDBNLJEAgBfEAmDX53nqhh0TEVhLT/JKLgRJfLAlSSdVjSyEC3gitdOhkt2lIw99OX7ypGNEc37x7kDD9GdfUmJg0CxEoZpnZnX3BJlFcx+2MMjDmmnZgbIWzZKFfkQUrnhXX0mxsEUovp0lK+kOx+koYyAFWBdCbSG7FynykO4Cl6ZAZoXtbc6PZZlktD9KY9eq+Gg7U1lDDDWey7+Ol+x5/JIQnBeMGUSbBHIkBeHmblszUJUKPoi7r8oiJEwUM1pAEbrC8zU4MqnFcc2OP4DZ0lHC4GsZ/B2Rm2aN5YxPt/hWx4A6ETsu8B5BGr7xworx91YJinOIrLW702XOXkNB8YZCD2DSuXmOq2F+ZocWTDfh54hS/MI8K4vdbh1JIH0g1EBRVz3cTAr9//u4mq+Yzgeo0SBBH/IE9QuRPm1/jv0EfFV2uQ0KSI8VfIdathS6x3UQK1zbUVszm72F9nVXaVRcMIytwBiVQitwmbOxxxboq6huUeppFohofjpkMqjltfx/rNEmAwNHb6wu6RE7iSaF+OkYCwRot4Q/yO5KBwfmQ6oFJGNpTz886yvyCjAFau2/emxk4czv85ON+Tv0AbvhgzMIUbheDwduHhj8WKHRPA+DbI11cGEULgQxlAYQQHur2NaM8wDpeyHNgJqTXEiL7I6X",
    libraryLocation: new URL("../../library/engine/", document.baseURI).toString(),
    moduleLoaders: [SDCBarcode.barcodeCaptureLoader({ highEndBlurryRecognition: false })],
  });

  // Create the data capture context.
  const context: SDCCore.DataCaptureContext = await SDCCore.DataCaptureContext.create();

  // Try to use the world-facing (back) camera and set it as the frame source of the context. The camera is off by
  // default and must be turned on to start streaming frames to the data capture context for recognition.
  const camera: SDCCore.Camera = SDCCore.Camera.default;
  await context.setFrameSource(camera);

  // The barcode capturing process is configured through barcode capture settings,
  // they are then applied to the barcode capture instance that manages barcode recognition.
  const settings: SDCBarcode.BarcodeCaptureSettings = new SDCBarcode.BarcodeCaptureSettings();

  // Filter out duplicate barcodes for 1 second.
  settings.codeDuplicateFilter = 1000;

  // The settings instance initially has all types of barcodes (symbologies) disabled. For the purpose of this
  // sample we enable a very generous set of symbologies. In your own app ensure that you only enable the
  // symbologies that your app requires as every additional enabled symbology has an impact on processing times.
  settings.enableSymbologies([
    SDCBarcode.Symbology.EAN13UPCA,
    SDCBarcode.Symbology.EAN8,
    SDCBarcode.Symbology.UPCE,
    SDCBarcode.Symbology.QR,
    SDCBarcode.Symbology.DataMatrix,
    SDCBarcode.Symbology.Code39,
    SDCBarcode.Symbology.Code128,
    SDCBarcode.Symbology.InterleavedTwoOfFive,
  ]);

  // Create a new barcode capture mode with the settings from above.
  const barcodeCapture = await SDCBarcode.BarcodeCapture.forContext(context, settings);
  // Disable the barcode capture mode until the camera is accessed.
  await barcodeCapture.setEnabled(false);

  // Register a listener to get informed whenever a new barcode got recognized.
  barcodeCapture.addListener({
    didScan: async (barcodeCaptureMode: SDCBarcode.BarcodeCapture, session: SDCBarcode.BarcodeCaptureSession) => {
      const barcode: SDCBarcode.Barcode = session.newlyRecognizedBarcodes[0];
      const symbology: SDCBarcode.SymbologyDescription = new SDCBarcode.SymbologyDescription(barcode.symbology);
      // Hide the viewfinder.
      await barcodeCaptureOverlay.setViewfinder(null);
      // Disable the capture of barcodes until the user closes the displayed result.
      await barcodeCapture.setEnabled(false);
      showResult(`${barcode.data!} (${symbology.readableName})`);
    },
  });

  // To visualize the ongoing barcode capturing process on screen, set up a data capture view that renders the
  // camera preview. The view must be connected to the data capture context.
  const view = await SDCCore.DataCaptureView.forContext(context);

  // Connect the data capture view to the HTML element.
  view.connectToElement(document.getElementById("data-capture-view")!);

  // Add a control to be able to switch cameras.
  view.addControl(new SDCCore.CameraSwitchControl());

  // Add a barcode capture overlay to the data capture view to render the location of captured barcodes on top of
  // the video preview. This is optional, but recommended for better visual feedback.
  const barcodeCaptureOverlay = await SDCBarcode.BarcodeCaptureOverlay.withBarcodeCaptureForViewWithStyle(
    barcodeCapture,
    view,
    SDCBarcode.BarcodeCaptureOverlayStyle.Frame
  );
  const viewfinder: SDCCore.Viewfinder = new SDCCore.RectangularViewfinder(
    SDCCore.RectangularViewfinderStyle.Square,
    SDCCore.RectangularViewfinderLineStyle.Light
  );
  await barcodeCaptureOverlay.setViewfinder(viewfinder);

  // Switch the camera on to start streaming frames.
  await camera.switchToDesiredState(SDCCore.FrameSourceState.On);
  await barcodeCapture.setEnabled(true);

  function showResult(result: string): void {
    const resultElement = document.createElement("div");
    resultElement.className = "result";
    resultElement.innerHTML = `<p class="result-text"></p><button onclick="continueScanning()">OK</button>`;
    resultElement.querySelector(".result-text")!.textContent = result;
    document.querySelector("#data-capture-view")!.append(resultElement);
  }

  window.continueScanning = async function continueScanning() {
    for (const r of document.querySelectorAll(".result")!) r.remove();
    await barcodeCapture.setEnabled(true);
    await barcodeCaptureOverlay.setViewfinder(viewfinder);
  };
}

run().catch((error) => {
  console.error(error);
  alert(error);
});
