import Head from "next/head"
import { Cube } from "phosphor-react"
import ReactDOM from "react-dom"
import { createRoot } from "react-dom/client"
import DeviceDetector from "device-detector-js"
import QRCode from "react-qr-code"
import { useEffect } from "react"

export default function Home () {
  // Display QR code to Vercel URL if user on desktop.
  const deviceDetector = new DeviceDetector()
  let isDesktop

  useEffect(() => {
    const data = deviceDetector.parse(navigator.userAgent)
    if (data.device.type == "desktop") {
      isDesktop = true
      const root = createRoot(document.getElementById("view-on-mobile"))
      root.render(
        <div className='flex flex-row gap-6 items-center'>
          <div id='qr-container' className='bg-white w-28 h-28 flex flex-none items-center justify-center'>
            <QRCode value='https://model-viewer-experiment.vercel.app' size={96} />
          </div>
          <div className='flex flex-col gap-2 text-black dark:text-white'>
            <span className='text-xl font-medium'>Desktop detected.</span>
            <p>View this model in AR on your phone by scanning the QR code.</p>
            <p className='text-sm dark:text-gray-300 text-gray-700'>
              Explanation: The user agent is parsed using{" "}
              <a
                href='https://github.com/etienne-martin/device-detector-js'
                className='text-blue-500 transition-all hover:text-blue-400'
              >
                device-detector-js
              </a>
              . If the device is desktop, this QR code banner is rendered into the DOM using ReactDOM's createRoot. The
              QR code is generated client-side using{" "}
              <a
                href='https://github.com/rosskhanas/react-qr-code'
                className='text-blue-500 transition-all hover:text-blue-400'
              >
                react-qr-code
              </a>
              .
            </p>
          </div>
        </div>
      )
      console.log(isDesktop)
    }
  }, [])

  return (
    <div className='flex flex-col items-start gap-4 min-h-screen px-8 py-6 dark:bg-black'>
      <Head>
        <title>model-viewer-experiment</title>
        <meta name='description' content='See the DigiSoc logo in your space.' />
        <link rel='icon' href='/favicon.ico' />
      </Head>
      <div className='flex flex-row items-center gap-2'>
        <Cube weight='regular' size={28} className='text-black dark:text-white' />
        <h1 className='text-2xl font-medium dark:text-white'>model-viewer-experiment</h1>
      </div>

      <p className='text-black dark:text-white'>
        This demonstrates the use of model-viewer to display an interactive 3D model on the web and in AR.
      </p>

      <div className='w-full flex justify-center'>
        <model-viewer
          style={{ height: "500px" }}
          bounds='tight'
          enable-pan
          src='/digisoc.glb'
          ar
          ar-modes='webxr scene-viewer quick-look'
          camera-controls
          environment-image='neutral'
          shadow-intensity='1'
        ></model-viewer>
      </div>

      <div id='view-on-mobile' />
    </div>
  )
}
