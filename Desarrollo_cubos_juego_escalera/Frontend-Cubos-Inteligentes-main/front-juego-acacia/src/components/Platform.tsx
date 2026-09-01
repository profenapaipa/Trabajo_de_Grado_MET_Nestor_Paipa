import PlatformConfigPopup from "./PlatformConfigPopup";

function Platform() {
    return (
        <div style={{
            width: '100%',
            height: '50px',
            margin: '0 auto',
            display: 'flex',
            backgroundColor: 'gray',
        }}>
            <PlatformConfigPopup />
        </div>
    );
}

export default Platform;