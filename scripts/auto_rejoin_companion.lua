--[[
    ═════════════════════════════════════════════════════════════════
    AUTO REJOIN & ANTI-AFK COMPANION (LUA EXECUTOR MODULE)
    Tool Auto Roblox Pro Edition
    
    Hỗ trợ tương thích: Delta, Fluxus, Codex, Arceus X, Hydrogen, Vega X...
    Cách dùng: Copy file này hoặc nội dung vào thư mục 'autoexec' của Executor.
    ═════════════════════════════════════════════════════════════════
--]]

repeat task.wait() until game:IsLoaded()

local Players = game:GetService("Players")
local GuiService = game:GetService("GuiService")
local TeleportService = game:GetService("TeleportService")
local VirtualUser = game:GetService("VirtualUser")
local HttpService = game:GetService("HttpService")

local LocalPlayer = Players.LocalPlayer
local PlaceId = game.PlaceId
local JobId = game.JobId

-- 1. Export Username & Anti-AFK Mechanism
if LocalPlayer then
    print("[AUTO_REJOIN_USER] " .. tostring(LocalPlayer.Name))
    pcall(function()
        if writefile then
            writefile("roblox_username.txt", tostring(LocalPlayer.Name))
        end
    end)
    LocalPlayer.Idled:Connect(function()
        pcall(function()
            VirtualUser:CaptureController()
            VirtualUser:ClickButton2(Vector2.new(0, 0))
        end)
    end)
end

-- 2. Smart Rejoin Logic khi nhận tín hiệu Disconnect từ GUI / CoreGui
local isRejoining = false

local function performRejoin()
    if isRejoining then return end
    isRejoining = true

    warn("[AutoRejoin] Phat hien mat ket noi / kick! Dang tien hanh Rejoin...")

    task.wait(1.5)

    -- Thu reconnect lai JobId hien tai truoc
    local success = pcall(function()
        if #Players:GetPlayers() <= 1 then
            TeleportService:Teleport(PlaceId, LocalPlayer)
        else
            TeleportService:TeleportToPlaceInstance(PlaceId, JobId, LocalPlayer)
        end
    end)

    -- Fallback: Neu JobId cu khong con ton tai thi hop sang server khac
    if not success then
        task.wait(2)
        pcall(function()
            TeleportService:Teleport(PlaceId, LocalPlayer)
        end)
    end
end

-- Hook Error Message Prompt
GuiService.ErrorMessageChanged:Connect(function(msg)
    if msg and msg ~= "" then
        performRejoin()
    end
end)

-- Hook Teleport Init Failure
TeleportService.TeleportInitFailed:Connect(function(player, teleportResult, errorMessage)
    if player == LocalPlayer then
        warn("[AutoRejoin] Teleport that bai (" .. tostring(errorMessage) .. "). Thu lai sau 3s...")
        task.wait(3)
        pcall(function()
            TeleportService:Teleport(PlaceId, LocalPlayer)
        end)
    end
end)

-- CoreGui Error Prompt Safety Hook (Neu co Prompt Error xuat hien tren man hinh)
pcall(function()
    local CoreGui = game:GetService("CoreGui")
    local RobloxPromptGui = CoreGui:FindFirstChild("RobloxPromptGui")
    if RobloxPromptGui then
        local promptOverlay = RobloxPromptGui:FindFirstChild("promptOverlay")
        if promptOverlay then
            promptOverlay.ChildAdded:Connect(function(child)
                if child.Name == "ErrorPrompt" then
                    performRejoin()
                end
            end)
        end
    end
end)

print("[AutoRejoin] Companion Script da duoc kich hoat thanh cong!")
