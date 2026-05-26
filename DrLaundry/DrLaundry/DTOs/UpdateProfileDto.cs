namespace DrLaundry.DTOs
{
    public class UpdateProfileDto
    {
        public string PhoneNumber { get; set; } = string.Empty;
        public string? Name { get; set; }
        public string? Address { get; set; }
    }
}
