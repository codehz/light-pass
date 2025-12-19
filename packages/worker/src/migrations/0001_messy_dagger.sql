-- Update existing chat configs to include the default response_template field
UPDATE `chats` SET `config` = json_set(`config`, '$.response_template', '用户{{user.display_name}}回答：\n{{response.answer}}') WHERE json_extract(`config`, '$.response_template') IS NULL;
