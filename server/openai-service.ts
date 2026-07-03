import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const getOpenAIKey = async () => {
  const { OPENAI_API_KEY } = await import('./hardcoded-config');
  return OPENAI_API_KEY;
};

// DISABLED: Alex AI chat disabled - OpenAI only for screenshot validation
// const openai = new OpenAI({ 
//   apiKey: 'DISABLED'
// });
const openai = null; // Disabled - OpenAI only for verification screenshots

export interface LeadSortRequest {
  userRequest: string;
  leads: any[];
  userEmail: string;
}

export interface LeadSortResponse {
  sortedLeads: any[];
  explanation: string;
  sortingLogic: string;
}

export interface AlexChatRequest {
  userEmail: string;
  message: string;
  context?: any;
}

export interface AlexChatResponse {
  response: string;
  actions?: any[];
  data?: any;
}

export async function chatWithAlex(request: AlexChatRequest): Promise<AlexChatResponse> {
  try {
    const { userEmail, message, context } = request;
    
    console.log(`🤖 ALEX AI CHAT: "${message}" from ${userEmail}`);
    console.log(`📥 Context received:`, JSON.stringify(context));

    // Check if this is a follow-up to a help request conversation
    if (context?.helpMode) {
      return await handleHelpConversation(userEmail, message, context);
    }

    // 🚨 CRITICAL: Check for actionable requests FIRST before calling GPT
    // This ensures actions like "add states" are handled immediately
    const actionableResponse = checkForActionableRequest(message, userEmail, context);
    if (actionableResponse) {
      console.log('✅ Detected actionable request - handling directly');
      return actionableResponse;
    }

    // DISABLED: OpenAI only for screenshot validation
    if (!openai) {
      return {
        response: "Alex AI chat is currently disabled. OpenAI API is only used for screenshot validation. Please submit a help ticket for assistance.",
        data: { disabled: true }
      };
    }

    // OpenAI is now always available with hardcoded key
    console.log('🤖 Using GPT-4o for response');

    const systemPrompt = `You are Alex, a technical support AI assistant for ConnectNow (AO Globe Life platform).

# YOUR ROLE
You can ONLY do 4 things. That's it. Nothing else.

When an agent asks for something:
1. Identify if it's one of the 4 actions below
2. Ask questions to get the required info
3. Execute the action when you have all data
4. For ANYTHING ELSE → Submit a help ticket

# THE 4 ACTIONS YOU CAN DO (NOTHING ELSE)

## 1. ADD LICENSED STATES
**When:** Agent says "add states", "I need more states", "add TX and CA for chrisfanning"
**What you need:** 
- Which agent? (ANY email ending in @aoglobelife.com is valid, including cnsysop@aoglobelife.com)
- Which states? (abbreviations like TX, CA, FL)

**Your response flow:**
- If missing agent: "Great! Which agent needs states added? (provide email)"
- If missing states: "Great! What states do you need? (Just list abbreviations like TX, CA, FL)"
- When you have BOTH agent email AND states: Call the add_licensed_states function immediately
- The function will handle the rest and return a confirmation

**CRITICAL:** If they provide an email like cnsysop@aoglobelife.com or chrisfanning@aoglobelife.com, that's the AGENT who needs states. Don't confuse it with a support contact.

## 2. RESET PASSWORD
**When:** Agent says "reset password", "can't log in", "forgot password"
**What you need:**
- Email address of the agent who needs reset

**Your response flow:**
- If missing email: "What's the agent's email address?"
- When you have email: Trigger reset_agent_password action
- After action: "Password reset to: aointel2025. They can log in with this password."

## 3. FIX VDP ERROR / NOT GETTING CALLS
**When:** Agent says "VDP error", "not getting calls", "dial session failed"
**What you need:**
- Agent email
- Their licensed states
- Their market (Veteran or Globe Market)

**Your response flow:**
- Ask: "What's the agent's email?"
- Ask: "What states are they licensed in? (list abbreviations)"
- Ask: "What market? (Veteran or Globe Market)"
- When you have all: Trigger fix_vdp_profile action
- After action: "VDP profile fixed. Refresh browser and it should work."

## 4. CHANGE MARKET
**When:** Agent says "change market", "set to Veteran", "switch to Globe Market"
**What you need:**
- Which agent?
- Which market? (Only "Veteran" or "Globe Market" are valid)

**Your response flow:**
- If missing info: Ask "Which agent and which market (Veteran or Globe Market)?"
- When you have both: Trigger the change_market action (NOT IMPLEMENTED YET - submit help ticket)
- After action: "Market updated to [market]. Log off and back on to see changes."

# CRITICAL: FOR ANYTHING ELSE → SUBMIT HELP TICKET
If the request is NOT one of the 4 actions above:
- Underwriting questions → Help ticket
- Schedule questions → Help ticket
- Lead management → Help ticket
- Reports → Help ticket
- ANY other question → Help ticket

**Response:** "I can help with adding states, resetting passwords, and fixing VDP errors. For other issues, let me submit a help ticket for you. What's the problem you're experiencing?"

# RULES
1. **Only do the 4 actions** - Nothing else
2. **ASK for missing info** - One question at a time
3. **Execute when you have all data** - Use the function calls
4. **Everything else = help ticket** - Don't try to answer underwriting, etc.
5. **Keep responses short** - 1-2 sentences max

Remember: You can ONLY add states, reset passwords, fix VDP errors, and change markets (not implemented yet → help ticket). Everything else gets a help ticket.`;

    // Build conversation history for context
    const conversationHistory = context?.conversationHistory || [];
    const messages = [
      {
        role: "system" as const,
        content: systemPrompt
      },
      // Add previous conversation messages for context
      ...conversationHistory.slice(-6), // Last 3 exchanges (6 messages)
      {
        role: "user" as const,
        content: message
      }
    ];

    // Define functions/tools that GPT-4o can call when it has all the data
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "add_licensed_states",
          description: "Add licensed states to an agent's profile. Call this when you have the agent email and states list.",
          parameters: {
            type: "object",
            properties: {
              agentEmail: {
                type: "string",
                description: "The agent's email address (or current user if not specified)"
              },
              states: {
                type: "array",
                items: { type: "string" },
                description: "Array of state abbreviations like ['TX', 'CA', 'FL']"
              }
            },
            required: ["states"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "reset_agent_password",
          description: "Reset an agent's password to aointel2025. Call this when you have the agent's email.",
          parameters: {
            type: "object",
            properties: {
              agentEmail: {
                type: "string",
                description: "The agent's email address"
              }
            },
            required: ["agentEmail"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "fix_vdp_profile",
          description: "Fix VDP profile for an agent. Call this when you have email, states, and market.",
          parameters: {
            type: "object",
            properties: {
              agentEmail: {
                type: "string",
                description: "The agent's email address"
              },
              states: {
                type: "array",
                items: { type: "string" },
                description: "Array of state abbreviations"
              },
              market: {
                type: "string",
                description: "Either 'Veteran' or 'Globe Market'"
              }
            },
            required: ["agentEmail", "states", "market"]
          }
        }
      }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      tools: tools,
      tool_choice: "auto", // Let GPT decide when to call functions
      temperature: 0.7,
      max_tokens: 500
    });

    const responseMessage = response.choices[0].message;
    
    // Check if GPT wants to call a function/tool
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);
      
      console.log(`✅ ALEX AI: Calling function ${functionName} with args:`, functionArgs);
      
      // Return the action for the frontend to execute
      return {
        response: `Great! I have all the information I need. One moment...`,
        actions: [
          {
            type: 'execute_action',
            action: functionName,
            parameters: functionArgs
          }
        ],
        data: { actionPending: true, functionName: functionName }
      };
    }
    
    // No function call - just return GPT's text response
    const aiResponse = responseMessage.content || "I'm sorry, I couldn't process that request right now.";
    
    console.log(`✅ ALEX AI RESPONSE: Generated ${aiResponse.length} character response`);
    
    return {
      response: aiResponse,
      actions: [],
      data: null
    };
    
  } catch (error) {
    console.error('❌ ALEX AI ERROR:', error);
    console.error('Error details:', error.message, error.stack);
    // Use fallback responses instead of error
    return generateFallbackResponse(message, userEmail);
  }
}

function checkForActionableRequest(message: string, userEmail: string, context?: any): AlexChatResponse | null {
  // This function checks if the message is an actionable request
  // Returns the action response if detected, null otherwise
  const response = generateFallbackResponse(message, userEmail, context);
  
  // Return if it has actions OR if it's gathering data for actions (awaitingStates, awaitingAgent, etc.)
  if (response.actions && response.actions.length > 0) {
    return response; // Has actions - execute them
  }
  
  // Also return if we're in the middle of gathering info for an action
  if (response.data && (response.data.awaitingStates || response.data.awaitingAgent || response.data.awaitingMarket || response.data.awaitingEmail)) {
    return response; // Gathering info - don't let GPT interfere
  }
  
  return null; // Not an action request - let GPT handle it
}

function generateFallbackResponse(message: string, userEmail: string, context?: any): AlexChatResponse {
  const lowerMessage = message.toLowerCase();
  
  // Add states detection - HIGHEST PRIORITY (broader detection)
  if (lowerMessage.includes('state') && (lowerMessage.includes('add') || lowerMessage.includes('need') || lowerMessage.includes('get') || lowerMessage.includes('want'))) {
    // Check if they're specifying another agent (has "for" keyword)
    const forAnotherAgent = lowerMessage.includes(' for ') || lowerMessage.includes(' to ');
    
    if (forAnotherAgent) {
      // They're adding states for someone else - ask which agent
      return {
        response: `Great! Which agent needs states added? (Provide their email like chrisfanning@aoglobelife.com)`,
        actions: [],
        data: { awaitingAgent: true, actionType: 'add_states' }
      };
    } else {
      // They're adding states for themselves - ask what states
      return {
        response: `Great! What states do you need?\n\nJust list the state abbreviations (example: CA, TX, WA, NM)`,
        actions: [],
        data: { awaitingStates: true }
      };
    }
  }
  
  // If awaiting agent email (from "add states for...")
  if (context?.awaitingAgent && context?.actionType === 'add_states') {
    // Try to extract email from message
    const emailMatch = message.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
    if (emailMatch) {
      const targetEmail = emailMatch[1];
      return {
        response: `Perfect! Now what states do you need to add for ${targetEmail}?\n\nJust list the abbreviations (example: TX, CA, FL)`,
        actions: [],
        data: { awaitingStates: true, targetAgent: targetEmail }
      };
    }
  }
  
  // If previous message was asking for states, parse this response
  // Use ORIGINAL message (not lowercased) to detect state abbreviations
  if (message.match(/\b[A-Z]{2}\b/) || lowerMessage.includes('texas') || lowerMessage.includes('florida') || lowerMessage.includes('california') || lowerMessage.includes('georgia') || lowerMessage.includes('new york')) {
    // Extract state abbreviations from ORIGINAL message (not lowercased)
    const stateMatches = message.match(/\b[A-Z]{2}\b/g) || [];
    const stateMap: { [key: string]: string } = {
      'texas': 'TX', 'florida': 'FL', 'california': 'CA', 'new york': 'NY',
      'georgia': 'GA', 'ohio': 'OH', 'pennsylvania': 'PA', 'illinois': 'IL',
      'michigan': 'MI', 'north carolina': 'NC', 'arizona': 'AZ', 'nevada': 'NV'
    };
    
    const foundStates = Object.keys(stateMap).filter(name => lowerMessage.includes(name)).map(name => stateMap[name]);
    const states = [...new Set([...stateMatches, ...foundStates])];
    
    if (states.length > 0) {
      // Check if there's a target agent in context
      const targetAgent = context?.targetAgent || null;
      
      if (targetAgent) {
        // Add states for another agent
        return {
          response: `OK Great! One moment...\n\n(Updating ${targetAgent}'s customer profile)`,
          actions: [
            {
              type: 'execute_action',
              action: 'add_licensed_states',
              parameters: { 
                states,
                agentEmail: targetAgent // Pass agent email for admin actions
              }
            }
          ],
          data: null
        };
      } else {
        // Add states for current user
        return {
          response: `OK Great! One moment...\n\n(Updating your customer profile)`,
          actions: [
            {
              type: 'execute_action',
              action: 'add_licensed_states',
              parameters: { states }
            }
          ],
          data: null
        };
      }
    }
  }
  
  // Detect agent name mentions (chrisfanning, etc.) - check if asking about adding states
  if ((lowerMessage.includes('add') && lowerMessage.includes('state')) || (context?.awaitingStates)) {
    if (lowerMessage.includes('chrisfanning') || lowerMessage.match(/for (?:agent )?([a-z]+@?)/i)) {
      const agentNameMatch = lowerMessage.match(/(?:for|to|agent)\s+([a-z0-9._%+-]+@?[a-z0-9.-]*@?[a-z]{0,})/i);
      if (agentNameMatch) {
        const agentName = agentNameMatch[1].trim();
        // Try to find email if it's just a name
        let agentEmail = agentName;
        if (!agentName.includes('@')) {
          agentEmail = `${agentName}@aoglobelife.com`;
        }
        
        return {
          response: `Great! What states do you need to add for ${agentEmail}?\n\nJust list the state abbreviations (example: TX, CA, FL, NM)`,
          actions: [],
          data: { awaitingStates: true, targetAgent: agentEmail }
        };
      }
    }
  }
  
  // Help request detection - highest priority
  if (lowerMessage.includes('help') || lowerMessage.includes('support') || lowerMessage.includes('issue') || lowerMessage.includes('problem') || lowerMessage.includes('trouble') || lowerMessage.includes('error') || lowerMessage.includes('bug') || lowerMessage.includes('not working')) {
    return {
      response: `🆘 **I'd be happy to help you get support!**

I can connect you directly with the AO Intelligence support team. I'll collect a few details to make sure you get the best help:

**What specific issue are you experiencing?** 
Please describe:
• What you were trying to do
• What happened instead
• Any error messages you saw

Just reply with the details of your issue, and I'll submit it directly to **aointel@aoglobelife.com** for you!

*Alternatively, you can click the "Hey Alex I need help" button in the chat header for a support form.*`,
      actions: [
        {
          type: 'help_request',
          action: 'collect_issue_details',
          parameters: {
            userEmail,
            step: 'collect_details'
          }
        }
      ],
      data: {
        helpMode: true,
        step: 'collect_details'
      }
    };
  }
  
  // Lead organization responses with actions
  if (lowerMessage.includes('organize') || lowerMessage.includes('sort') || lowerMessage.includes('priority')) {
    // Check if user specifically wants to organize PLUS leads by state
    if (lowerMessage.includes('plus') && lowerMessage.includes('state')) {
      return {
        response: `🌟 **I'll organize your PLUS leads by state A-Z right now!**

This will reorganize all your Traditional/Plus market leads alphabetically:

• **Alabama plus leads first**
• **Alaska plus leads second**  
• **Arizona plus leads third**
• **...and so on alphabetically**

**This modifies your actual Supabase plus leads data - not just the display.**

Ready to sort your plus leads by state? I can execute this immediately!`,
        actions: [
          {
            type: 'execute_action',
            action: 'sort_plus_leads_by_state',
            parameters: {}
          }
        ],
        data: null
      };
    }
    // Check if user specifically wants to organize by state
    else if (lowerMessage.includes('state')) {
      return {
        response: `🌎 **I'll organize your entire lead database by state right now!**

This will reorganize ALL your leads alphabetically by state (hotleads stay at top):

• **Alabama leads first**
• **Alaska leads second**  
• **Arizona leads third**
• **...and so on alphabetically**

**This modifies your actual Supabase lead table - not just the display.**

Ready to sort your leads by state? I can do this immediately and show you the results!`,
        actions: [
          {
            type: 'execute_action',
            action: 'sort_leads_by_state',
            parameters: {}
          }
        ],
        data: null
      };
    }
    
    return {
      response: `I can actually organize your leads right now! Here are the actions I can take:

**🔥 Priority Actions:**
• **Sort by state** - Group leads by location for efficient calling
• **Move hotleads to top** - Ensure priority leads come first
• **Filter by market** - Organize by Veteran, Traditional, etc.
• **Sort by call count** - Prioritize fresh leads

**📊 Data Actions I Can Perform:**
• **Update lead status** - Mark leads as contacted, interested, etc.
• **Add notes** - Record important information about leads
• **Set priority levels** - Flag high-value prospects
• **Organize by date** - Sort by most recent or oldest first

Would you like me to sort your leads by state or reorganize your queue by priority? Just tell me what specific action you want!`,
      actions: [
        {
          type: 'sort_leads',
          options: ['by_state', 'by_priority', 'by_market', 'by_call_count']
        },
        {
          type: 'filter_leads',
          options: ['hotleads_only', 'by_state', 'by_market']
        }
      ],
      data: null
    };
  }
  
  // Lead search and modification responses
  if (lowerMessage.includes('search') || lowerMessage.includes('find') || lowerMessage.includes('lead')) {
    return {
      response: `I can help you search AND organize your leads! Here's what I can do:

**🔍 Search Actions:**
• **Find leads by state** - "Show me all Texas leads"
• **Filter by market** - "Find all Veteran leads"
• **Search by name** - "Find John Smith"

**🎯 Actual Lead Table Actions I Can Perform:**
• **Sort entire lead database by state** - Reorganize all leads alphabetically by location
• **Prioritize by market** - Put Veteran leads first, Traditional second
• **Filter and display specific groups** - Show only certain states or markets
• **Update lead status** - Mark leads as contacted, interested, etc.

**Ready to modify your lead data right now!** 
Would you like me to:
1. Sort all your leads by state?
2. Filter to show only Veteran market leads?
3. Organize by priority (Veteran > Traditional)?

Just say "sort by state" or "show veteran leads" and I'll modify your actual lead table!`,
      actions: [
        {
          type: 'sort_leads',
          options: ['by_state', 'by_priority', 'by_market']
        },
        {
          type: 'filter_leads', 
          options: ['veteran_only', 'traditional_only', 'by_state']
        },
        {
          type: 'modify_data',
          options: ['sort_database', 'update_status', 'organize_custom']
        }
      ],
      data: null
    };
  }
  
  // Hotlead responses
  if (lowerMessage.includes('hotlead') || lowerMessage.includes('hot lead')) {
    return {
      response: `Your hotlead system is working great! Here's what you need to know:

• **Auto-Prioritization**: Hotleads automatically appear at the top of your queue
• **Visual Indicators**: Hotleads show with 🔥 icons
• **Protected Position**: Hotleads never get moved or sorted - they stay at the top
• **Smart Assignment**: The system automatically assigns new hotleads to you

Your current queue prioritizes hotleads first, then regular leads. The system ensures you always work the highest priority leads first!`,
      actions: [],
      data: null
    };
  }
  
  // Underwriting responses
  if (lowerMessage.includes('underwriting') || lowerMessage.includes('medical') || lowerMessage.includes('table') || lowerMessage.includes('diabetes') || lowerMessage.includes('asthma')) {
    return {
      response: `I can help with underwriting questions! Here are some common guidelines:

• **Diabetes**: A1C levels under 7.0 are typically preferred, 7.0-8.5 may get table ratings
• **Asthma**: Mild, controlled asthma is usually acceptable at standard rates
• **Build Charts**: Height/weight ratios determine table ratings
• **Medical Records**: Recent records (within 2 years) are preferred

For specific medical conditions, always consult the latest underwriting guidelines or contact your underwriting team for complex cases.`,
      actions: [],
      data: null
    };
  }
  
  // Lead table modification detection
  if (lowerMessage.includes('sort') && lowerMessage.includes('state')) {
    return {
      response: `🌎 **I'll sort your entire lead database by state right now!**

This will reorganize ALL your leads alphabetically by state (hotleads stay at top):

• **Alabama leads first**
• **Alaska leads second**  
• **Arizona leads third**
• **...and so on alphabetically**

**This modifies your actual Supabase lead table - not just the display.**

Ready to sort your leads by state? I can do this immediately and show you the results!`,
      actions: [
        {
          type: 'execute_action',
          action: 'sort_leads_by_state',
          parameters: {}
        }
      ],
      data: null
    };
  }

  if (lowerMessage.includes('veteran') || (lowerMessage.includes('show') && lowerMessage.includes('market'))) {
    return {
      response: `🎯 **I'll filter your leads to show only Veteran market leads!**

This will:
• **Query your Supabase masterlead table**
• **Return only leads with market = 'Veteran'**  
• **Show you the actual filtered results**

This is real data from your lead database, not just search suggestions.

Want me to pull all your Veteran leads from the database right now?`,
      actions: [
        {
          type: 'execute_action',
          action: 'filter_leads_by_market',
          parameters: { market: 'Veteran' }
        }
      ],
      data: null
    };
  }

  if (lowerMessage.includes('priority') || lowerMessage.includes('organize')) {
    return {
      response: `⭐ **I'll reorganize your leads by priority in your database!**

This will sort your masterlead table:
• **Hotleads stay at the very top**
• **Veteran market leads next (highest priority)**
• **Traditional market leads after that**
• **Other markets last**
• **Within each group: newest leads first**

**This permanently reorganizes your Supabase lead data.**

Ready to prioritize your entire lead database?`,
      actions: [
        {
          type: 'execute_action',
          action: 'sort_leads_by_priority',
          parameters: {}
        }
      ],
      data: null
    };
  }

  // If we got here and it's not an actionable request, return null
  // This will let GPT-4o handle it with the proper system prompt
  return {
    response: `Hi! I'm Alex, your ConnectNow assistant. What do you need help with?`,
    actions: [],
    data: null
  };
}

export async function organizeLeadsWithAI(request: LeadSortRequest): Promise<LeadSortResponse> {
  try {
    // DISABLED: OpenAI only for screenshot validation
    if (!openai) {
      return {
        success: false,
        error: "AI lead organization is currently disabled. OpenAI API is only used for screenshot validation.",
        sortedLeads: request.leads, // Return original order
        explanation: "AI sorting disabled"
      };
    }

    const { userRequest, leads, userEmail } = request;
    
    // Separate hotleads from regular leads
    const hotleads = leads.filter(lead => lead.is_hot_lead || lead.isHotLead);
    const regularLeads = leads.filter(lead => !lead.is_hot_lead && !lead.isHotLead);
    
    console.log(`🤖 AI LEAD SORT: Processing ${regularLeads.length} regular leads for: ${userEmail}`);
    console.log(`🔥 HOTLEADS PRESERVED: ${hotleads.length} hotleads will stay at top`);
    
    // Create lead summary for AI processing
    const leadSummary = regularLeads.map(lead => ({
      id: lead.id,
      name: lead.name || `${lead.first_name} ${lead.last_name}`,
      state: lead.state || lead.taalk_state,
      market: lead.market || lead.taalk_market,
      city: lead.city,
      phone: lead.phone,
      priority: lead.priority_score || 0
    }));

    const prompt = `You are Alex, an AI assistant that helps sales agents organize their leads. 

CRITICAL RULES:
1. NEVER touch hotleads - they always stay at the top
2. Only organize the regular leads provided
3. Return a JSON response with sorted lead IDs

User Request: "${userRequest}"

Available Regular Leads (${regularLeads.length} total):
${JSON.stringify(leadSummary, null, 2)}

Organize these leads according to the user's request. Return a JSON response with:
1. "sortedLeadIds": Array of lead IDs in the new order
2. "explanation": Brief explanation of how you sorted them
3. "sortingLogic": Technical description of the sorting criteria used

Example response format:
{
  "sortedLeadIds": [123, 456, 789],
  "explanation": "Organized with Texas leads first, then California leads, both sorted alphabetically by name",
  "sortingLogic": "state_priority(TX,CA) -> alphabetical_by_name"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are Alex, a helpful AI assistant for sales agents. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const aiResponse = JSON.parse(response.choices[0].message.content || '{}');
    
    // Rebuild the sorted leads array
    const sortedRegularLeads = aiResponse.sortedLeadIds.map((id: number) => 
      regularLeads.find(lead => lead.id === id)
    ).filter(Boolean);
    
    // Combine: Hotleads first, then AI-sorted regular leads
    const finalSortedLeads = [...hotleads, ...sortedRegularLeads];
    
    console.log(`✅ AI SORT COMPLETE: ${hotleads.length} hotleads + ${sortedRegularLeads.length} sorted regular leads`);
    console.log(`🧠 AI EXPLANATION: ${aiResponse.explanation}`);
    
    return {
      sortedLeads: finalSortedLeads,
      explanation: aiResponse.explanation,
      sortingLogic: aiResponse.sortingLogic
    };
    
  } catch (error: any) {
    console.error('❌ AI Lead Sort Error:', error);
    
    // Fallback: Return original order with hotleads first
    const hotleads = leads.filter(lead => lead.is_hot_lead || lead.isHotLead);
    const regularLeads = leads.filter(lead => !lead.is_hot_lead && !lead.isHotLead);
    
    return {
      sortedLeads: [...hotleads, ...regularLeads],
      explanation: "AI sorting failed, using default order with hotleads first",
      sortingLogic: "fallback_default_order"
    };
  }
}

// Handle help conversation flow
async function handleHelpConversation(userEmail: string, message: string, context: any): Promise<AlexChatResponse> {
  const lowerMessage = message.toLowerCase();
  
  console.log(`🆘 ALEX AI: Help conversation step '${context.step}' for ${userEmail}`);
  
  // Step 1: User provided issue details, now collect subject if needed
  if (context.step === 'collect_details') {
    // Check if message looks like it has enough detail to proceed
    if (message.length > 20) {
      return {
        response: `✅ **Thank you for the details!**

I have your issue description:
"${message}"

**What would you like the subject line to be for your support ticket?**

You can say something like:
• "Calling Issues"
• "Lead Management Problem" 
• "Technical Support"
• Or just type "Submit" to use "General Support Request"

I'll send this directly to **aointel@aoglobelife.com** once you provide a subject!`,
        actions: [
          {
            type: 'help_request',
            action: 'collect_subject',
            parameters: {
              userEmail,
              step: 'collect_subject',
              issueDetails: message
            }
          }
        ],
        data: {
          helpMode: true,
          step: 'collect_subject',
          issueDetails: message
        }
      };
    } else {
      return {
        response: `🤔 **Could you provide a bit more detail?**

Please describe:
• What specific issue you're experiencing
• What you were trying to do when it happened
• Any error messages you saw

The more details you provide, the better our support team can help you!`,
        actions: [],
        data: {
          helpMode: true,
          step: 'collect_details'
        }
      };
    }
  }
  
  // Step 2: User provided subject, now submit the help request
  if (context.step === 'collect_subject') {
    const subject = lowerMessage === 'submit' ? 'General Support Request' : message;
    
    return {
      response: `🚀 **Submitting your support request now...**

**Subject:** ${subject}
**Issue:** ${context.issueDetails}
**Sending to:** aointel@aoglobelife.com

This will be sent momentarily!`,
      actions: [
        {
          type: 'execute_action',
          action: 'submit_help_request',
          parameters: {
            subject: subject,
            message: context.issueDetails,
            userEmail: userEmail
          }
        }
      ],
      data: {
        helpMode: false,
        submitting: true
      }
    };
  }
  
  // Fallback - restart help flow
  return {
    response: `🆘 **Let me help you get support!**

**What specific issue are you experiencing?** Please describe the problem in detail.`,
    actions: [],
    data: {
      helpMode: true,
      step: 'collect_details'
    }
  };
}