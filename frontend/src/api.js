const API_URL = 'http://localhost:5000';

export const processCommand = async (command) => {
  try {
    const response = await fetch(`${API_URL}/api/process-command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
    });
    
    const data = await response.json();
    return {
      success: true,
      angles: {
        mpFlex: data.CMC_flex,
        mpAbd: data.CMC_abd,
        pipFlex: data.MCP_flex,
        dipFlex: data.IP_flex
      },
      message: `Command processed successfully`
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to connect to backend'
    };
  }
};