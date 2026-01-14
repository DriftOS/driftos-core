// Quick test to check if metadata is being returned
const fetch = require('node-fetch');

async function test() {
  try {
    // First, create a conversation
    const createConv = await fetch('http://localhost:3001/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const convData = await createConv.json();
    console.log('Create conversation response:', JSON.stringify(convData, null, 2));

    if (!convData.success) {
      console.log('\n❌ Cannot test - auth required. Please check in browser instead.');
      return;
    }

    const conversationId = convData.data.id;

    // Send a message
    const sendMsg = await fetch('http://localhost:3001/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        content: 'Hello, can you help me learn Python?',
        role: 'user'
      })
    });

    const msgData = await sendMsg.json();
    console.log('\n📨 Message response:');
    console.log('Action:', msgData.data?.action);
    console.log('Metadata:', JSON.stringify(msgData.data?.metadata, null, 2));

    if (msgData.data?.metadata?.llmAnalysis) {
      console.log('\n✅ LLM Analysis is present!');
      console.log('Reason:', msgData.data.metadata.llmAnalysis.reason);
    } else {
      console.log('\n❌ No LLM Analysis in metadata');
      console.log('Full response:', JSON.stringify(msgData, null, 2));
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
