import World from "./components/WumpusBoard";
import "@/styles/root.scss";

const App = () => {
  return (
    <div className="app-container">
      <div className="world-wrapper">
        <World />
      </div>
    </div>
  );
};

export default App;
