import './App.css'
import { SplashHud } from './components/SplashHud/SplashHud'

function App() {
  return (
    <main className="app">
      <SplashHud seed={42} />
    </main>
  )
}

export default App
