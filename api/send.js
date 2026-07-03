export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "POST only"
        });
    }

    const { message } = req.body;

    const token = process.env.BOT_TOKEN;
    const chatId = process.env.CHAT_ID;

    const telegram = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message
            })
        }
    );

    const data = await telegram.json();

    return res.status(200).json(data);
}