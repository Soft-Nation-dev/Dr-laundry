namespace DrLaundry.Models
{
    public class EmailOtp
    {
        public int Id { get; set; }
        public string? Email { get; set; }
        public required string Code { get; set; }
        public DateTime ExpiryTime { get; set; }
        public bool IsUsed { get; set; }
    }
}
