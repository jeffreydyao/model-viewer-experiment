import "../styles/globals.css"
import "@fontsource/spline-sans"

function MyApp ({ Component, pageProps }) {
  return (
    <>
      <script
        type='module'
        src='https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js'
        strategy='beforeInteractive'
      />
      <Component {...pageProps} />
    </>
  )
}

export default MyApp
