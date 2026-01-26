import os
from dotenv import load_dotenv
from litellm import completion

# Load environment variables from .env file
load_dotenv()

def run_llm(model: str, message: str) -> str:
    """
    Run any LLM model using litellm and return the response.
    
    Args:
        model (str): The model identifier (e.g. "gpt-3.5-turbo", "claude-2", etc.)
        message (str): The input message/prompt to send to the model
        
    Returns:
        str: The model's response text
    """
    try:
        print(f"Running model {model} with message {message}")
        response = completion(
            model=model,
            messages=[{
                "role": "user",
                "content": message
            }]
        )
        
        # Extract the response text from the completion
        if response and hasattr(response, 'choices') and len(response.choices) > 0:
            return response.choices[0].message.content
        else:
            return "Error: No response generated"
            
    except Exception as e:
        return f"Error running model {model}: {str(e)}"


if __name__ == "__main__":
    # Example: Get sentiment analysis for a stock on a specific date
    stock_ticker = "AAPL"
    date = "2024-01-15"
    prompt = f"Analyze the market sentiment for {stock_ticker} stock on {date}. Provide a sentiment score (positive, negative, or neutral) and brief reasoning."
    print(run_llm("xai/grok-3", prompt))