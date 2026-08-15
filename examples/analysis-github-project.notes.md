# 解读Github项目智能机器人

## Workflow Brief

- Mode: workflow
- Inputs: `github_url`, optional `focus`
- Flow: Start -> Parse GitHub URL -> HTTP README -> HTTP root structure -> Code cleanup -> LLM analysis -> End
- Model: `langgenius/deepseek/deepseek` / `deepseek-chat`

## External Dependencies

- Public access to `https://api.github.com`.
- Unauthenticated GitHub API rate limits apply. For company deployment, consider an internal GitHub proxy or an HTTP Request node with a GitHub token.

## Output Contract

- `project_analysis_report`: Markdown report
- `repo_full_name`: parsed owner/repo
- `readme_error`: README fetch/decode error, empty when ok
- `structure_error`: structure fetch/parse error, empty when ok

## Adaptation Notes

The original DifyAIA folder uses a Flask helper service (`readme.py`) with `/get_readme` and `/get_structure`. This generated version calls GitHub API directly from Dify so it is easier to import and test. If the company Dify cannot reach GitHub, replace the two HTTP nodes with calls to an internal service equivalent to `readme.py`.
